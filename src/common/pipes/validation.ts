import { ValidationError } from 'class-validator';
import { BadRequestException } from '@nestjs/common';

function flattenErrors(errors: ValidationError[], parent = ''): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;

    if (error.constraints) {
      messages.push(...Object.values(error.constraints));
    }

    if (error.children?.length) {
      messages.push(...flattenErrors(error.children, field));
    }
  }

  return messages;
}

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    message: flattenErrors(errors),
    error: 'VALIDATION_ERROR',
  });
}
