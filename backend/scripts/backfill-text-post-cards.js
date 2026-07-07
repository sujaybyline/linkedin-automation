require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { query } = require("../db");

async function backfillTextPostCards() {
  const orphans = await query(
    `SELECT p.id, p.post_id, p.content_pillar, p.audience, p.created_by,
            c.final_post_text
     FROM posts p
     LEFT JOIN visual_cards vc ON vc.post_id = p.post_id
     LEFT JOIN captions c ON c.post_id = p.id
     WHERE vc.id IS NULL`
  );

  for (const row of orphans) {
    const topic = String(row.final_post_text || "Text post")
      .split("\n")[0]  
      .slice(0, 200)
      .trim() || "Text post";

    const cardResult = await query(
      `INSERT INTO visual_cards
       (post_id, storage_path, filename, topic, content_pillar, audience, card_status, created_by)
       VALUES (?, '_text_', 'text-post', ?, ?, ?, 'needs_review', ?)`,
      [
        row.post_id,
        topic,
        row.content_pillar || "Thought leadership",
        row.audience || "Professional audience",
        row.created_by,
      ]
    );

    await query(
      `UPDATE posts SET visual_card_id = ?, media_type = 'text' WHERE id = ?`,
      [cardResult.insertId, row.id]
    );
    console.log(`Backfilled card for ${row.post_id}: ${topic.slice(0, 60)}`);
  }

  console.log(`Backfilled ${orphans.length} text-only post(s)`);
}

backfillTextPostCards()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err.message);
    process.exit(1);
  });
