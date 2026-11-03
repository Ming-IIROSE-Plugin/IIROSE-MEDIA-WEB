import { readJson } from "../../storage/localStore";
import { BilibiliACC } from "./BilibiliAccountInterface";

export class GetBiliBiliAccount {
  public getBiliBiliAccount() {
    return readJson<BilibiliACC | null>("bilibiliAccount", null);
  }
}
