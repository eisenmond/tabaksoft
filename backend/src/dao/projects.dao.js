import { ObjectId } from "mongodb";
import { BaseDAO } from "./base.dao.js";

export class ProjectsDAO extends BaseDAO {
  async createProject({ ownerId, name, description, status }) {
    return this.create({ ownerId: new ObjectId(ownerId), name, description, status });
  }

  async listForUser(userId, options) {
    return this.list({ ...options, filter: { ownerId: new ObjectId(userId) } });
  }

  async findOwnedById(id, userId) {
    const project = await this.findById(id);
    return project && project.ownerId.toString() === userId ? project : null;
  }

  async updateOwnedById(id, userId, changes) {
    const project = await this.findOwnedById(id, userId);
    return project ? this.updateById(id, changes) : null;
  }

  async deleteOwnedById(id, userId) {
    const project = await this.findOwnedById(id, userId);
    return project ? this.deleteById(id) : false;
  }

  async createIndexes() {
    await this.collection.createIndex({ ownerId: 1, createdAt: -1 });
  }
}
