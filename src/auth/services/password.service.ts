import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  constructor(private readonly configService: ConfigService) {}

  async hash(plainText: string): Promise<string> {
    const saltRounds = this.configService.get<number>(
      'security.bcryptSaltRounds',
    ) as number;
    return bcrypt.hash(plainText, saltRounds);
  }

  async compare(plainText: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainText, hash);
  }
}
