import { request } from "./request.js";
import type { modelService } from "../../../../store/nodejs/src/router/models_service.js";
import type { ApiService } from "../../../../store/nodejs/src/router/api_service.js";
import type { UserService } from "../../../../store/nodejs/src/router/user_service.js";
import type * as model from "../../../../store/nodejs/src/db/models/index";
type FirstParameter<T extends (...args: any[]) => any> = T extends (
  first: infer F,
  ...args: any[]
) => any
  ? F
  : never;
// function exampleFunction(a: number, b: string, c: boolean) {
//   // 函数体
// }

// type FirstArg = FirstParameter<typeof exampleFunction>; // 结果是 number
// type A = (typeof ApiService.prototype)["image_comment"];

// type B = FirstParameter<A>;

export function callApi<k extends keyof ApiService>(
  command: k,
  body: FirstParameter<ApiService[k]> | FormData,
): Promise<ReturnType<ApiService[k]>> {
  return request("/api/" + command, { method: "post", body: body });
}

export function callUser<k extends keyof UserService>(
  command: k,
  body: FirstParameter<UserService[k]> | FormData,
): Promise<ReturnType<UserService[k]>> {
  return request("/user/" + command, { method: "post", body: body });
}

type ModelService = typeof modelService; // 这里假设你有一个包含所有服务的类型别名
export function callModel<k extends keyof ModelService>(
  command: k,
  body: FirstParameter<ModelService[k]> | FormData,
): Promise<ReturnType<ModelService[k]>> {
  return request("/model/" + command, { method: "post", body: body });
}

export { model };
