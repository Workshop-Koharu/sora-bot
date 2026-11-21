import { StorageManager } from "../database/storage.js";
import { UserPointRecord, ShopItem } from "../types/index.js";

export class PointsService {
  public static getUserRecord(guildId: string, userId: string): UserPointRecord {
    const data = StorageManager.getGuildData(guildId);
    if (!data.points[userId]) {
      data.points[userId] = {
        guildId,
        userId,
        points: 0,
        attendanceStreak: 0,
        inventory: [],
      };
      StorageManager.saveGuildData(data);
    }
    return data.points[userId];
  }

  public static addPoints(
    guildId: string,
    userId: string,
    amount: number
  ): UserPointRecord {
    const data = StorageManager.getGuildData(guildId);
    const user = this.getUserRecord(guildId, userId);
    user.points = Math.max(0, user.points + amount);
    data.points[userId] = user;
    StorageManager.saveGuildData(data);
    return user;
  }

  public static checkAttendance(
    guildId: string,
    userId: string
  ): { success: boolean; earned: number; streak: number; message: string } {
    const data = StorageManager.getGuildData(guildId);
    const user = this.getUserRecord(guildId, userId);
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    if (user.lastAttendanceDate === today) {
      return {
        success: false,
        earned: 0,
        streak: user.attendanceStreak,
        message: "이미 오늘 출석체크를 완료하셨습니다. 내일 다시 시도해 주세요!",
      };
    }

    // Check if yesterday was attended to increment streak
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);

    if (user.lastAttendanceDate === yesterday) {
      user.attendanceStreak += 1;
    } else {
      user.attendanceStreak = 1;
    }

    user.lastAttendanceDate = today;

    // Base: 100 points + (streak * 10 up to 100 bonus)
    const bonus = Math.min(100, user.attendanceStreak * 10);
    const totalEarned = 100 + bonus;
    user.points += totalEarned;

    data.points[userId] = user;
    StorageManager.saveGuildData(data);

    return {
      success: true,
      earned: totalEarned,
      streak: user.attendanceStreak,
      message: `출석 완료! +${totalEarned}P 지급 (연속 ${user.attendanceStreak}일차 보너스 +${bonus}P)`,
    };
  }

  public static transferPoints(
    guildId: string,
    fromUserId: string,
    toUserId: string,
    amount: number
  ): { success: boolean; error?: string } {
    if (fromUserId === toUserId) {
      return { success: false, error: "자기 자신에게는 송금할 수 없습니다." };
    }
    if (amount <= 0) {
      return { success: false, error: "송금할 포인트는 1P 이상이어야 합니다." };
    }

    const data = StorageManager.getGuildData(guildId);
    const sender = this.getUserRecord(guildId, fromUserId);
    const receiver = this.getUserRecord(guildId, toUserId);

    if (sender.points < amount) {
      return {
        success: false,
        error: `보유 포인트가 부족합니다. (현재: ${sender.points.toLocaleString()}P)`,
      };
    }

    sender.points -= amount;
    receiver.points += amount;

    data.points[fromUserId] = sender;
    data.points[toUserId] = receiver;
    StorageManager.saveGuildData(data);

    return { success: true };
  }

  public static gamblePoints(
    guildId: string,
    userId: string,
    amount: number,
    game: "coinflip" | "dice"
  ): { win: boolean; reward: number; balance: number; detail: string } {
    const data = StorageManager.getGuildData(guildId);
    const user = this.getUserRecord(guildId, userId);

    if (user.points < amount) {
      throw new Error(`보유 포인트가 부족합니다. (현재: ${user.points.toLocaleString()}P)`);
    }

    user.points -= amount;

    let win = false;
    let reward = 0;
    let detail = "";

    if (game === "coinflip") {
      const flip = Math.random() < 0.5 ? "앞면" : "뒷면";
      win = Math.random() < 0.48; // 48% win rate
      if (win) {
        reward = amount * 2;
        user.points += reward;
        detail = `동전 결과: [${flip}] - 적중! 2배 획득!`;
      } else {
        detail = `동전 결과: [${flip}] - 빗나갔습니다.`;
      }
    } else {
      const dice = Math.floor(Math.random() * 6) + 1;
      win = dice >= 4; // 4, 5, 6 win
      if (win) {
        reward = Math.floor(amount * 1.8);
        user.points += reward;
        detail = `주사위 결과: [${dice}] - 승리! 1.8배 획득!`;
      } else {
        detail = `주사위 결과: [${dice}] - 패배!`;
      }
    }

    data.points[userId] = user;
    StorageManager.saveGuildData(data);

    return { win, reward, balance: user.points, detail };
  }

  public static getLeaderboard(
    guildId: string,
    limit = 10
  ): Array<{ userId: string; points: number; rank: number }> {
    const data = StorageManager.getGuildData(guildId);
    const sorted = Object.values(data.points).sort((a, b) => b.points - a.points);
    return sorted.slice(0, limit).map((u, i) => ({
      userId: u.userId,
      points: u.points,
      rank: i + 1,
    }));
  }

  public static buyShopItem(
    guildId: string,
    userId: string,
    itemId: string
  ): { success: boolean; item?: ShopItem; error?: string } {
    const data = StorageManager.getGuildData(guildId);
    const item = data.shopItems.find((i) => i.id === itemId);
    if (!item) {
      return { success: false, error: "존재하지 않는 상품입니다." };
    }

    const user = this.getUserRecord(guildId, userId);
    if (user.points < item.price) {
      return {
        success: false,
        error: `포인트가 부족합니다. (필요: ${item.price.toLocaleString()}P, 보유: ${user.points.toLocaleString()}P)`,
      };
    }

    user.points -= item.price;
    user.inventory.push({
      itemId: item.id,
      itemName: item.name,
      acquiredAt: new Date().toISOString(),
    });

    data.points[userId] = user;
    StorageManager.saveGuildData(data);

    return { success: true, item };
  }
}
