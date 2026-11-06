import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.addressesService.findAll(user);
  }

  @Post()
  @ResponseMessage('Address created successfully')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAddressDto) {
    return this.addressesService.create(user, dto);
  }

  @Patch(':id')
  @ResponseMessage('Address updated successfully')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAddressDto) {
    return this.addressesService.update(user, id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Address deleted successfully')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.addressesService.remove(user, id);
  }
}
