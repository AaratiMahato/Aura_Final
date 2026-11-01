import crypto from 'crypto';

export const cloudinaryEnabled = () =>
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

// Instagram can only fetch images from a public https URL. Cloudinary (free plan) gives us one,
// so Instagram posting works even while you run the app on your own computer.
export async function uploadToCloudinary(buffer) {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'aura-pro';
  const signature = crypto
    .createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`)
    .digest('hex');
  const fd = new FormData();
  fd.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'photo.jpg');
  fd.append('api_key', process.env.CLOUDINARY_API_KEY);
  fd.append('timestamp', String(timestamp));
  fd.append('folder', folder);
  fd.append('signature', signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: fd,
  });
  const data = await res.json();
  if (data.error) throw new Error(`Cloudinary: ${data.error.message}`);
  return data.secure_url;
}
