import { Body, Controller, Get, Patch } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { CustomersService } from './customers.service';
import { UpdateCustomerDto } from './dto/customer.dto';

/**
 * Canonical customer account endpoint required by the API contract.
 * `/customers/me` remains available for backwards compatibility.
 */
@Controller('me')
export class MeController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  getMe(@CurrentUser() user: AuthUser) {
    return this.customersService.getMe(user);
  }

  @Patch()
  @ResponseMessage('Profile updated successfully')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateCustomerDto) {
    return this.customersService.updateMe(user, dto);
  }
}
