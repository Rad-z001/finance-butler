import type { PrismaClient, User } from "@prisma/client";
import { DEFAULT_TIMEZONE } from "@finance-butler/shared";
import { logger } from "../utils/logger.js";

export interface LineProfileFetcher {
  getProfile(lineUserId: string): Promise<{ displayName: string; pictureUrl?: string }>;
}

/** Auto-registration: any LINE user who talks to the bot gets an account row + default Cash wallet. */
export class UserService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly profiles: LineProfileFetcher,
  ) {}

  async findOrCreateByLineId(lineUserId: string): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { lineUserId } });
    if (existing) return existing;

    let displayName = "คุณลูกค้า";
    let pictureUrl: string | undefined;
    try {
      const p = await this.profiles.getProfile(lineUserId);
      displayName = p.displayName;
      pictureUrl = p.pictureUrl;
    } catch (err) {
      logger.warn({ err }, "profile fetch failed; registering with defaults");
    }

    const user = await this.prisma.user.create({
      data: {
        lineUserId,
        displayName,
        ...(pictureUrl ? { pictureUrl } : {}),
        timezone: DEFAULT_TIMEZONE,
        accounts: {
          create: { name: "เงินสด", type: "CASH", provider: "cash", isDefault: true },
        },
      },
    });
    logger.info({ userId: user.id }, "registered new user");
    return user;
  }

  async setActive(lineUserId: string, isActive: boolean): Promise<void> {
    await this.prisma.user.updateMany({ where: { lineUserId }, data: { isActive } });
  }

  /** Match "SCB" / "เงินสด" / "kbank" to one of the user's accounts. */
  async findAccountByHint(userId: string, hint: string) {
    return this.prisma.account.findFirst({
      where: {
        userId,
        isArchived: false,
        OR: [
          { name: { contains: hint, mode: "insensitive" } },
          { provider: { equals: hint.toLowerCase() } },
        ],
      },
    });
  }

  async defaultAccount(userId: string) {
    const acc =
      (await this.prisma.account.findFirst({
        where: { userId, isDefault: true, isArchived: false },
      })) ??
      (await this.prisma.account.findFirst({
        where: { userId, isArchived: false },
        orderBy: { sortOrder: "asc" },
      }));
    if (!acc) {
      return this.prisma.account.create({
        data: { userId, name: "เงินสด", type: "CASH", provider: "cash", isDefault: true },
      });
    }
    return acc;
  }
}
