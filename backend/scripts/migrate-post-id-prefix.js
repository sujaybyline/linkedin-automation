require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs/promises");
const path = require("path");
const env = require("../env");
const { query } = require("../db");

const UPLOAD_DIR = env.UPLOAD_DIR;

async function migrate() {
  const posts = await query(
    "SELECT post_id FROM posts WHERE post_id LIKE 'CLAUDE-CARD-%'"
  );

  for (const row of posts) {
    const oldId = row.post_id;
    const newId = oldId.replace(/^CLAUDE-CARD-/, "POST-");

    await query("UPDATE posts SET post_id = ? WHERE post_id = ?", [newId, oldId]);
    await query("UPDATE visual_cards SET post_id = ? WHERE post_id = ?", [newId, oldId]);
    await query(
      "UPDATE visual_cards SET storage_path = REPLACE(storage_path, ?, ?) WHERE post_id = ? AND storage_path LIKE ?",
      [oldId, newId, newId, `${oldId}%`]
    );

    const oldDir = path.join(UPLOAD_DIR, oldId);
    const newDir = path.join(UPLOAD_DIR, newId);
    try {
      await fs.access(oldDir);
      await fs.rename(oldDir, newDir);
      console.log(`Renamed upload folder ${oldId} → ${newId}`);
    } catch {
      /* no image folder for text posts */
    }

    console.log(`Renamed ${oldId} → ${newId}`);
  }

  console.log(`Migrated ${posts.length} post ID(s) from CLAUDE-CARD-* to POST-*`);
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err.message);
    process.exit(1);
  });
