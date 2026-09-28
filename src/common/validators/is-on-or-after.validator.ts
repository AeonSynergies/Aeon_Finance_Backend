import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsOnOrAfter(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isOnOrAfter',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints as [string];
          const relatedValue = (args.object as Record<string, unknown>)[
            relatedPropertyName
          ];
          if (typeof value !== 'string' || typeof relatedValue !== 'string') {
            return false;
          }
          const valueDate = new Date(value);
          const relatedDate = new Date(relatedValue);
          if (isNaN(valueDate.getTime()) || isNaN(relatedDate.getTime())) {
            return false;
          }
          return valueDate.getTime() >= relatedDate.getTime();
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints as [string];
          return `${args.property} must be on or after ${relatedPropertyName}`;
        },
      },
    });
  };
}
