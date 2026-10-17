/* 媒体类型判断：部分机型 file.type 为空，需结合扩展名判断视频 */
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|avi|mkv|3gp|flv|wmv|mpeg|mpg)$/i;

export const isVideoFile = (f) => (f?.type ? f.type.startsWith('video') : false) || VIDEO_EXT.test(f?.name || '');
