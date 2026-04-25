import { faker } from "@faker-js/faker";

export function fakeName() {
  faker.seed();
  return `${faker.word.adjective()}-${faker.word.noun()}`;
}
