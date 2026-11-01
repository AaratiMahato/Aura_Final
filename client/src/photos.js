// Every photo URL of a post (older posts only have a single imageUrl)
export const postImages = (post) =>
  post?.images?.length ? post.images.map((i) => i.url) : post?.imageUrl ? [post.imageUrl] : [];
export const MAX_PHOTOS = 10;
