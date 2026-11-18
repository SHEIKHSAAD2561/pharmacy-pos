import { sql } from "drizzle-orm";
import { route } from "@/lib/server/api";
import { getSettings } from "@/lib/server/settings";
import { rowsOf } from "@/lib/server/shifts";

export const GET = route(async ({ db }) => {
  const settings = await getSettings(db);
  const tz = settings.timezone || "UTC";
  const alertDays = settings.expiryAlertDays;
  const localToday = sql`(now() at time zone ${tz})::date`;
  const saleDay = sql`(s.created_at at time zone ${tz})::date`;

  const [kpis] = rowsOf<Record<string, number>>(
    await db.execute(sql`
      select
        coalesce(sum(s.total - s.refunded_amount) filter (where ${saleDay} = ${localToday}), 0)::float8 as today_revenue,
        count(*) filter (where ${saleDay} = ${localToday})::int as today_count,
        coalesce(sum(s.total - s.refunded_amount) filter (where ${saleDay} = ${localToday} - 1), 0)::float8 as yesterday_revenue,
        coalesce(sum(s.total - s.refunded_amount) filter (where date_trunc('month', ${saleDay}) = date_trunc('month', ${localToday})), 0)::float8 as month_revenue,
        count(*) filter (where date_trunc('month', ${saleDay}) = date_trunc('month', ${localToday}))::int as month_count
      from sales s
    `),
  );

  const [todayProfit] = rowsOf<{ profit: number }>(
    await db.execute(sql`
      select coalesce(sum(((i.total - i.tax) / nullif(i.quantity, 0) - i.cost_price) * (i.quantity - i.returned_qty)), 0)::float8 as profit
      from sale_items i join sales s on s.id = i.sale_id
      where ${saleDay} = ${localToday}
    `),
  );

  const [stock] = rowsOf<Record<string, number>>(
    await db.execute(sql`
      with st as (
        select p.id, p.reorder_level,
          coalesce((select sum(b.quantity) from batches b where b.product_id = p.id and b.quantity > 0 and b.expiry_date >= current_date), 0) as qty
        from products p where p.active
      )
      select
        count(*)::int as product_count,
        count(*) filter (where qty = 0)::int as out_of_stock,
        count(*) filter (where qty > 0 and qty <= reorder_level)::int as low_stock,
        (select count(*) from batches b where b.quantity > 0 and b.expiry_date < current_date)::int as expired_batches,
        (select count(*) from batches b where b.quantity > 0 and b.expiry_date >= current_date and b.expiry_date <= current_date + ${alertDays}::int)::int as expiring_batches,
        (select coalesce(sum(b.quantity * b.cost_price), 0) from batches b where b.quantity > 0 and b.expiry_date >= current_date)::float8 as stock_value,
        (select count(*) from prescriptions r where r.status = 'pending')::int as pending_prescriptions,
        (select count(*) from customers)::int as customer_count
      from st
    `),
  );

  const series = rowsOf<{ day: string; revenue: number; orders: number }>(
    await db.execute(sql`
      with days as (
        select generate_series(${localToday} - 13, ${localToday}, interval '1 day')::date as day
      )
      select to_char(d.day, 'YYYY-MM-DD') as day,
        coalesce(sum(s.total - s.refunded_amount), 0)::float8 as revenue,
        count(s.id)::int as orders
      from days d left join sales s on ${saleDay} = d.day
      group by d.day order by d.day
    `),
  );

  const topProducts = rowsOf<{ name: string; quantity: number; revenue: number }>(
    await db.execute(sql`
      select i.name, sum(i.quantity - i.returned_qty)::int as quantity, sum(i.total)::float8 as revenue
      from sale_items i join sales s on s.id = i.sale_id
      where ${saleDay} >= ${localToday} - 29
      group by i.name order by quantity desc limit 6
    `),
  );

  const payments = rowsOf<{ method: string; amount: number }>(
    await db.execute(sql`
      select 'Cash' as method, coalesce(sum(s.cash_amount - s.change_given), 0)::float8 as amount from sales s where ${saleDay} >= ${localToday} - 29
      union all select 'Card', coalesce(sum(s.card_amount), 0)::float8 from sales s where ${saleDay} >= ${localToday} - 29
      union all select 'Insurance', coalesce(sum(s.insurance_amount), 0)::float8 from sales s where ${saleDay} >= ${localToday} - 29
      union all select 'Other', coalesce(sum(s.other_amount + s.points_value), 0)::float8 from sales s where ${saleDay} >= ${localToday} - 29
    `),
  );

  const recentSales = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select s.id, s.invoice_no as "invoiceNo", s.total::float8 as total, s.status, s.payment_method as "paymentMethod",
        s.created_at as "createdAt", c.name as "customerName"
      from sales s left join customers c on c.id = s.customer_id
      order by s.created_at desc limit 6
    `),
  );

  const lowStock = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select * from (
        select p.id, p.name, p.strength, p.reorder_level as "reorderLevel",
          coalesce((select sum(b.quantity) from batches b where b.product_id = p.id and b.quantity > 0 and b.expiry_date >= current_date), 0)::int as stock
        from products p where p.active
      ) t where stock <= "reorderLevel" order by stock asc, name limit 6
    `),
  );

  const expiring = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select b.id, p.name, p.strength, b.batch_number as "batchNumber", b.expiry_date::text as "expiryDate", b.quantity
      from batches b join products p on p.id = b.product_id
      where b.quantity > 0 and b.expiry_date <= current_date + ${alertDays}::int
      order by b.expiry_date asc limit 6
    `),
  );

  return {
    kpis: { ...kpis, today_profit: todayProfit?.profit ?? 0 },
    stock,
    series,
    topProducts,
    payments,
    recentSales,
    lowStock,
    expiring,
  };
});
