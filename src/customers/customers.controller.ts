import { Body, Controller, Get, Patch } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { CustomersService } from './customers.service';
import { UpdateCustomerDto } from './dto/customer.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.customersService.getMe(user);
  }

  @Patch('me')
  @ResponseMessage('Profile updated successfully')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateCustomerDto) {
    return this.customersService.updateMe(user, dto);
  }
}
