declare module 'virtual:framework/messages' {
  const preload: (locale: string) => Promise<void>;
  export default preload;
}
