import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    passwordHash: String,
    googleId: { type: String, unique: true, sparse: true },
    facebookId: { type: String, unique: true, sparse: true },
    instagramId: { type: String, unique: true, sparse: true },
    instagram: {
      username: String,
      accountType: String,
      token: String, // AES-256-GCM encrypted
      tokenExpiresAt: Date,
      connectedAt: Date,
    },
    avatar: String,
    businessName: { type: String, default: '' },
    captionTone: { type: String, default: 'Warm & professional' },
    businessType: { type: String, default: 'Photography' },
    audience: { type: String, default: '' },
    location: { type: String, default: '' },
    keywords: { type: String, default: '' },
    callToAction: { type: String, default: '' },
    autoPost: { type: Boolean, default: false },
    meta: {
      pageId: String,
      pageName: String,
      pageToken: String, // AES-256-GCM encrypted
      igUserId: String,
      igUsername: String,
      connectedAt: Date,
      // every Page the user manages, so they can pick which one to post to
      pages: [
        {
          _id: false,
          pageId: String,
          pageName: String,
          pageToken: String, // AES-256-GCM encrypted
          igUserId: String,
          igUsername: String,
        },
      ],
    },
  },
  { timestamps: true }
);

userSchema.methods.toSafe = function () {
  return {
    id: this.id,
    name: this.name,
    email: this.email,
    avatar: this.avatar,
    businessName: this.businessName,
    captionTone: this.captionTone,
    businessType: this.businessType || 'Photography',
    audience: this.audience || '',
    location: this.location || '',
    keywords: this.keywords || '',
    callToAction: this.callToAction || '',
    autoPost: Boolean(this.autoPost),
    meta: {
      pageId: this.meta?.pageId || null,
      pages: (this.meta?.pages || []).map((p) => ({
        pageId: p.pageId,
        pageName: p.pageName,
        igUsername: p.igUsername || null,
      })),
      facebook: Boolean(this.meta?.pageId),
      instagram: Boolean(this.meta?.igUserId),
      pageName: this.meta?.pageName || null,
      igUsername: this.meta?.igUsername || null,
    },
  };
};

export default mongoose.model('User', userSchema);
