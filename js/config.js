export const CONFIG = {
  mode: 'proxy', // 'direct' | 'proxy'

  direct: {
    baseUrl: 'http://192.168.200.6:25461'
  },

  proxy: {
    baseUrl: 'http://localhost:8080'
  },

  transcode: true,

  get apiBaseUrl() {
    return this.direct.baseUrl;
  },

  get streamProxyUrl() {
    return `${this.proxy.baseUrl}/stream-proxy`;
  },

  get transcodeUrl() {
    return `${this.proxy.baseUrl}/stream-transcode`;
  }
};