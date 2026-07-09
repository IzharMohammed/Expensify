declare module 'bullmq' {
  export const Queue: any;
  export const Worker: any;
  export type Job = any;
}

declare module 'ioredis' {
  const IORedis: any;
  export default IORedis;
}
