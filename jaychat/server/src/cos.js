/* 腾讯云对象存储 COS 客户端封装（仅使用官方 SDK 的 putObject / getObject） */
import fs from 'node:fs';
import COS_SDK from 'cos-nodejs-sdk-v5';
import { COS } from './config.js';

let client = null;
function getClient() {
  if (!COS.enabled) return null;
  if (!client) {
    const opts = { SecretId: COS.secretId, SecretKey: COS.secretKey };
    // 自定义接口地址（私有化部署 / 网关 / 本地联调）
    if (COS.endpoint) {
      const u = new URL(COS.endpoint);
      opts.Protocol = u.protocol;
      opts.Domain = u.host;
    }
    client = new COS_SDK(opts);
  }
  return client;
}

export const cosEnabled = () => COS.enabled;

/** 上传本地文件到 COS，返回 { key, url }（大文件自动分片上传） */
export function uploadFile(localPath, key, contentType) {
  const c = getClient();
  if (!c) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    c.uploadFile(
      { Bucket: COS.bucket, Region: COS.region, Key: key, FilePath: localPath, ContentType: contentType },
      (err, data) => {
        if (err) return reject(err);
        resolve({ key, url: COS.url(key), etag: data?.ETag });
      },
    );
  });
}

/** 下载 COS 对象写入本地文件；对象不存在返回 false */
export function downloadFile(key, destPath) {
  const c = getClient();
  if (!c) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    c.getObject({ Bucket: COS.bucket, Region: COS.region, Key: key }, (err, data) => {
      if (err) {
        if (err.statusCode === 404 || err.code === 'NoSuchKey') return resolve(false);
        return reject(err);
      }
      fs.writeFileSync(destPath, data.Body);
      resolve(true);
    });
  });
}
