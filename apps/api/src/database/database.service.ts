import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { createDatabaseClient, type DatabaseClient } from "@sistema-erp/database";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private client?: DatabaseClient;

  async ping(): Promise<void> {
    this.client ??= createDatabaseClient();
    await this.client.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect();
  }
}
