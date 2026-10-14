import { BaseDAO } from "./base.dao.js";
import { ObjectId } from "mongodb";

export class SessionsDAO extends BaseDAO {
  async createSession({ userId, refreshTokenHash, expiresAt, userAgent, ip }) {
    return this.create({ userId, refreshTokenHash, expiresAt, userAgent, ip, lastUsedAt: new Date(), revokedAt: null });
  }
  async findActiveByHash(refreshTokenHash) { return this.collection.findOne({ refreshTokenHash, revokedAt: null, expiresAt: { $gt: new Date() } }); }
  async rotate(id, oldHash, refreshTokenHash, expiresAt) {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id), refreshTokenHash: oldHash, revokedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { refreshTokenHash, expiresAt, lastUsedAt: new Date(), updatedAt: new Date() } }, { returnDocument: "after" },
    );
    return result.value;
  }
  async isActive(id, userId) { return ObjectId.isValid(id) && Boolean(await this.collection.findOne({ _id: new ObjectId(id), userId, revokedAt: null, expiresAt: { $gt: new Date() } })); }
  async listForUser(userId) { return this.collection.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } }).sort({ lastUsedAt: -1 }).toArray(); }
  async revoke(id, userId) { if (!ObjectId.isValid(id)) return false; return (await this.collection.updateOne({ _id: new ObjectId(id), userId, revokedAt: null }, { $set: { revokedAt: new Date() } })).modifiedCount === 1; }
  async revokeOthers(userId, exceptId) { await this.collection.updateMany({ userId, _id: { $ne: new ObjectId(exceptId) }, revokedAt: null }, { $set: { revokedAt: new Date() } }); }
  async revokeAll(userId) { await this.collection.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } }); }
  async createIndexes() { await this.collection.createIndex({ refreshTokenHash: 1 }, { unique: true }); await this.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); await this.collection.createIndex({ userId: 1, revokedAt: 1 }); }
}
