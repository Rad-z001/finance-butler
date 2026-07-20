import { messagingApi } from "@line/bot-sdk";
import type { LineProfileFetcher } from "../services/user.service.js";
import { logger } from "../utils/logger.js";

export type LineMessage = messagingApi.Message;

export interface ILineMessenger extends LineProfileFetcher {
  reply(replyToken: string, messages: LineMessage[]): Promise<void>;
  push(lineUserId: string, messages: LineMessage[]): Promise<void>;
  /** group name, or a Thai fallback when the API has none (e.g. rooms) */
  getGroupName(groupId: string): Promise<string>;
  /** display name of a group member, with a Thai fallback */
  getMemberName(groupId: string, memberUserId: string): Promise<string>;
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

  async getGroupName(groupId: string): Promise<string> {
    try {
      const g = await this.api.getGroupSummary(groupId);
      return g.groupName || "กลุ่มของเรา";
    } catch {
      return "กลุ่มของเรา"; // rooms have no summary API
    }
  }

  async getMemberName(groupId: string, memberUserId: string): Promise<string> {
    try {
      const p = await this.api.getGroupMemberProfile(groupId, memberUserId);
      return p.displayName || "สมาชิก";
    } catch {
      return "สมาชิก";
    }
  }
}
