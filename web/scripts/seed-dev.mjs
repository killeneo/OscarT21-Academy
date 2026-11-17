// Development-only seed: synthetic specialist profiles flagged is_demo = true. Never run against production.
// Usage: npm run db:seed   (idempotent: replaces previous demo rows)
import pg from "pg";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed demo data in production.");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (see web/.env.example).");
  process.exit(1);
}

// Obviously fictional names; no real people.
const first = ["Алия", "Тимур", "Дилноза", "Рустам", "Сабина", "Азиз", "Мадина", "Бахтиёр", "Гульнара", "Жасур", "Зарина", "Олим"];
const last = ["Демо-А.", "Демо-Б.", "Демо-В.", "Демо-Г."];
const cities = ["tashkent", "samarkand", "bukhara", "andijan", "namangan", "fergana", "nukus", "navoi"];
const cats = ["speech_therapist", "defectologist", "psychologist", "special_educator", "tutor", "sensory_integration", "physio_therapy", "rehabilitation", "aba", "other"];
const headlines = [
  "Индивидуальные занятия, мягкий старт и понятный план",
  "Работаю с детьми дошкольного и младшего школьного возраста",
  "Сопровождение в школе и консультации для родителей",
  "Коррекционные занятия в игровой форме",
  "Онлайн-консультации и домашние задания для семьи",
];

const statuses = ["confirmed", "confirmed", "confirmed", "awaiting_moderation"];
const rows = [];
for (let i = 0; i < 36; i++) {
  const ageMin = [0, 2, 3, 5, 7][i % 5];
  const price = 80_000 + (i % 9) * 30_000;
  rows.push({
    name: `${first[i % first.length]} ${last[i % last.length]}`,
    category: cats[i % cats.length],
    headline: headlines[i % headlines.length],
    city: cities[(i * 3) % cities.length],
    formats: i % 3 === 0 ? ["online"] : i % 3 === 1 ? ["offline"] : ["online", "offline"],
    priceFrom: price,
    priceTo: price + (i % 4) * 20_000,
    exp: 1 + ((i * 7) % 18),
    ageMin,
    ageMax: Math.min(18, ageMin + 4 + (i % 8)),
    rating: Math.round((3.4 + ((i * 37) % 17) / 10) * 10) / 10,
    reviews: (i * 13) % 60,
    popularity: (i * 53) % 400,
    status: statuses[i % statuses.length],
  });
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("DELETE FROM specialist_profiles WHERE is_demo");
  for (const r of rows) {
    await client.query(
      `INSERT INTO specialist_profiles
        (display_name, category, headline, city, formats, price_from, price_to, experience_years, age_min, age_max,
         rating_avg, reviews_count, popularity, verification_status, is_published, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true,true)`,
      [r.name, r.category, r.headline, r.city, r.formats, r.priceFrom, r.priceTo, r.exp, r.ageMin, r.ageMax, Math.min(5, r.rating), r.reviews, r.popularity, r.status],
    );
  }
  await client.query("COMMIT");
  console.log(`seeded ${rows.length} demo specialists`);
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  await client.end();
}
