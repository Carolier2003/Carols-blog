import { onRequest as __admin_images_ts_onRequest } from "/Users/carol/develop/my-blog/Carols-blog/functions/admin/images.ts"

export const routes = [
    {
      routePath: "/admin/images",
      mountPath: "/admin",
      method: "",
      middlewares: [],
      modules: [__admin_images_ts_onRequest],
    },
  ]