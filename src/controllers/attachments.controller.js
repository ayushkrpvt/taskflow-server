const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

async function presign(req, res, next) {
  try {
    const { task_id, file_name, file_type } = req.body;
    const ext = file_name.split('.').pop();
    const key = `tasks/${task_id}/${uuidv4()}.${ext}`;
    const client = getR2Client();
    const url = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, ContentType: file_type }),
      { expiresIn: 300 }
    );
    res.json({ upload_url: url, storage_key: key, file_url: `${process.env.R2_PUBLIC_URL}/${key}` });
  } catch (err) { next(err); }
}

async function confirm(req, res, next) {
  try {
    const { task_id, original_name, storage_key, file_url, file_type, file_size_bytes } = req.body;
    const [rows] = await db.query(
      'INSERT INTO task_attachments (task_id, uploaded_by, original_name, storage_key, file_url, file_type, file_size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
      [task_id, req.user.id, original_name, storage_key, file_url, file_type, file_size_bytes || null]
    );
    res.status(201).json({ id: rows[0].id, file_url });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const [rows] = await db.query('SELECT * FROM task_attachments WHERE id = ?', [req.params.id]);
    const att = rows[0];
    if (!att) return res.status(404).json({ message: 'Attachment not found' });
    await getR2Client().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: att.storage_key }));
    await db.query('DELETE FROM task_attachments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}

module.exports = { presign, confirm, remove };
