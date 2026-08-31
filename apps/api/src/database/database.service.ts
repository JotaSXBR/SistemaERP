import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { createDatabaseClient } from "@sistema-erp/database";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly client = createDatabaseClient();

  async ping(): Promise<void> {
    await this.client.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
