import { ApiProperty } from '@nestjs/swagger';

export class UserProfileResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  isEmailVerified!: boolean;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty({ type: [String] })
  permissions!: string[];
}

export class AuthTokensResponse {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty()
  user!: UserProfileResponse;
}

export class MessageResponse {
  @ApiProperty()
  message!: string;
}
