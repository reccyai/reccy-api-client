import { Electroview } from "electrobun/view";
import type { ElectrobunRPCSchema } from "electrobun/view";
import type { AppRPCSchema } from "../../shared/rpcContract";

let rpc: ReturnType<
  typeof Electroview.defineRPC<AppRPCSchema & ElectrobunRPCSchema>
> | null = null;

function getRpc() {
  if (!rpc) {
    rpc = Electroview.defineRPC<AppRPCSchema & ElectrobunRPCSchema>({
      handlers: {
        requests: {},
        messages: {},
      },
    });

    new Electroview({ rpc });
  }

  return rpc;
}

export function bunRequest() {
  return getRpc().request;
}
