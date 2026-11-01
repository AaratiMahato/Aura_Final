import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema(
  { ok: Boolean, id: String, error: String },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // First photo (kept for older posts); every photo of the post is listed in `images`
    images: [{ _id: false, path: String, url: String, publicUrl: String }],
    imagePath: { type: String, required: true },
    imageUrl: { type: String, required: true }, // e.g. /uploads/abc.jpg
    publicUrl: String, // public https copy used by Instagram
    caption: { type: String, default: '', maxlength: 2200 },
    hashtags: [String],
    platforms: [{ type: String, enum: ['facebook', 'instagram'] }],
    status: { type: String, enum: ['draft', 'published', 'failed'], default: 'draft', index: true },
    results: { facebook: resultSchema, instagram: resultSchema },
    publishedAt: Date,
  },
  { timestamps: true }
);

postSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Post', postSchema);
