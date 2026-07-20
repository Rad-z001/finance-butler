import { messagingApi } from "@line/bot-sdk";
import type { LineProfileFetcher } from "../services/user.service.js";
import { logger } from "../utils/logger.js";

export type LineMessage = messagingApi.Message;

export interface ILineMessenger extends LineProfileFetcher {
  reply(replyToken: string, messages: LineMessage[]): Promise<void>;
  push(lineUserId: string, messages: LineMessage[]): Promise<void>;
}

export class LineMessenger implements ILineMessenger {
  private readonly api: messagingApi.MessagingApiClient;

  constructor(channelAccessToken: string) {
    this.api = new messagingApi.MessagingApiClient({ channelAccessToken });
  }

  async reply(replyToken: string, messages: LineMessage[]): Promise<void> {
    try {
      await this.api.replyMessage({ replyToken, messages });
    } catch (err) {
      logger.error({ err }, "LINE reply failed");
    }
  }

  async push(lineUserId: string, messages: LineMessage[]): Promise<void> {
    await this.api.pushMessage({ to: lineUserId, messages });
  }

  async getProfile(lineUserId: string): Promise<{ displayName: string; pictureUrl?: string }> {
    const p = await this.api.getProfile(lineUserId);
    return { displayName: p.displayName, ...(p.pictureUrl ? { pictureUrl: p.pictureUrl } : {}) };
  }
}
