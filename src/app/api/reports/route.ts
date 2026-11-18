import { sql } from "drizzle-orm";
import { badRequest, route, searchParam } from "@/lib/server/api";
import { getSettings } from "@/lib/server/settings";
import { rowsOf } from "@/lib/server/shifts";

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export const GET = route(
  async ({ req, db }) => {
    const settings = await getSettings(db);
    const tz = settings.timezone || "UTC";
    const from = searchParam(req, "from");
    const to = searchParam(req, "to");
    if (!isDate(from) || !isDate(to)) throw badRequest("Choose a valid date range");
    if (from > to) throw badRequest("The start date must be before the end date");

    const saleDay = sql`(s.created_at at time zone ${tz})::date`;
    const inRange = sql`${saleDay} between ${from}::date and ${to}::date`;

    const [summary] = rowsOf<Record<string, number>>(
      await db.execute(sql`
        select
          count(*)::int as orders,
          coalesce(sum(s.subtotal), 0)::float8 as gross_sales,
          coalesce(sum(s.discount), 0)::float8 as discounts,
          coalesce(sum(s.tax), 0)::float8 as tax,
          coalesce(sum(s.total), 0)::float8 as total,
          coalesce(sum(s.refunded_amount), 0)::float8 as refunds,
          coalesce(sum(s.insurance_amount), 0)::float8 as insurance,
          coalesce(sum(s.points_value), 0)::float8 as points,
          coalesce(sum(s.cash_amount - s.change_given), 0)::float8 as cash,
          coalesce(sum(s.card_amount), 0)::float8 as card,
          coalesce(sum(s.other_amount), 0)::float8 as other,
          count(distinct s.customer_id)::int as customers
        from sales s where ${inRange}
      `),
    );

    const [margin] = rowsOf<{ net_revenue: number; cost: number; units: number }>(
      await db.execute(sql`
        select
          coalesce(sum((i.total - i.tax) * (i.quantity - i.returned_qty) / nullif(i.quantity, 0)), 0)::float8 as net_revenue,
          coalesce(sum(i.cost_price * (i.quantity - i.returned_qty)), 0)::float8 as cost,
          coalesce(sum(i.quantity - i.returned_qty), 0)::int as units
        from sale_items i join sales s on s.id = i.sale_id where ${inRange}
      `),
    );

    const daily = rowsOf<{ day: string; revenue: number; orders: number; profit: number }>(
      await db.execute(sql`
        with days as (select generate_series(${from}::date, ${to}::date, interval '1 day')::date as day),
        sale_totals as (
          select ${saleDay} as day, sum(s.total - s.refunded_amount) as revenue, count(*) as orders
          from sales s where ${inRange} group by 1
        ),
        profit as (
          select ${saleDay} as day,
            sum(((i.total - i.tax) / nullif(i.quantity, 0) - i.cost_price) * (i.quantity - i.returned_qty)) as profit
          from sale_items i join sales s on s.id = i.sale_id where ${inRange} group by 1
        )
        select to_char(d.day, 'YYYY-MM-DD') as day,
          coalesce(t.revenue, 0)::float8 as revenue, coalesce(t.orders, 0)::int as orders, coalesce(p.profit, 0)::float8 as profit
        from days d left join sale_totals t on t.day = d.day left join profit p on p.day = d.day
        order by d.day
      `),
    );

    const byCategory = rowsOf<{ category: string; revenue: number; quantity: number }>(
      await db.execute(sql`
        select coalesce(c.name, 'Uncategorized') as category,
          sum(i.total * (i.quantity - i.returned_qty) / nullif(i.quantity, 0))::float8 as revenue,
          sum(i.quantity - i.returned_qty)::int as quantity
        from sale_items i join sales s on s.id = i.sale_id
        join products p on p.id = i.product_id left join categories c on c.id = p.category_id
        where ${inRange} group by 1 order by revenue desc
      `),
    );

    const topProducts = rowsOf<{ name: string; quantity: number; revenue: number; profit: number }>(
      await db.execute(sql`
        select i.name,
          sum(i.quantity - i.returned_qty)::int as quantity,
          sum(i.total * (i.quantity - i.returned_qty) / nullif(i.quantity, 0))::float8 as revenue,
          sum(((i.total - i.tax) / nullif(i.quantity, 0) - i.cost_price) * (i.quantity - i.returned_qty))::float8 as profit
        from sale_items i join sales s on s.id = i.sale_id
        where ${inRange} group by i.name order by revenue desc limit 15
      `),
    );

    const byCashier = rowsOf<{ cashier: string; orders: number; revenue: number }>(
      await db.execute(sql`
        select coalesce(u.name, 'Unknown') as cashier, count(*)::int as orders, sum(s.total - s.refunded_amount)::float8 as revenue
        from sales s left join users u on u.id = s.user_id where ${inRange} group by 1 order by revenue desc
      `),
    );

    const byHour = rowsOf<{ hour: number; orders: number; revenue: number }>(
      await db.execute(sql`
        select h.hour, coalesce(count(s.id), 0)::int as orders, coalesce(sum(s.total), 0)::float8 as revenue
        from generate_series(0, 23) as h(hour)
        left join sales s on extract(hour from (s.created_at at time zone ${tz}))::int = h.hour and ${inRange}
        group by h.hour order by h.hour
      `),
    );

    const [inventory] = rowsOf<Record<string, number>>(
      await db.execute(sql`
        select
          coalesce(sum(b.quantity * b.cost_price), 0)::float8 as cost_value,
          coalesce(sum(b.quantity * p.sell_price), 0)::float8 as retail_value,
          coalesce(sum(b.quantity), 0)::int as units,
          coalesce(sum(b.quantity * b.cost_price) filter (where b.expiry_date < current_date), 0)::float8 as expired_value
        from batches b join products p on p.id = b.product_id where b.quantity > 0
      `),
    );

    const writeOffs = rowsOf<{ type: string; units: number; value: number }>(
      await db.execute(sql`
        select m.type, sum(-m.quantity)::int as units, sum(-m.quantity * coalesce(b.cost_price, 0))::float8 as value
        from stock_movements m left join batches b on b.id = m.batch_id
        where m.type in ('expired', 'damaged') and (m.created_at at time zone ${tz})::date between ${from}::date and ${to}::date
        group by m.type
      `),
    );

    const netRevenue = margin?.net_revenue ?? 0;
    const cost = margin?.cost ?? 0;
    return {
      range: { from, to },
      summary: {
        ...summary,
        net_revenue: netRevenue,
        cost,
        profit: netRevenue - cost,
        margin: netRevenue > 0 ? ((netRevenue - cost) / netRevenue) * 100 : 0,
        units: margin?.units ?? 0,
        avg_order: summary.orders ? (summary.total - summary.refunds) / summary.orders : 0,
      },
      daily,
      byCategory,
      topProducts,
      byCashier,
      byHour,
      inventory,
      writeOffs,
    };
  },
  { roles: ["admin", "pharmacist"] },
);
