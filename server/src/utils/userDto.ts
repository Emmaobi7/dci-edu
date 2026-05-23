import type { Role } from '@prisma/client';

export const userDtoSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  disabledAt: true,
  firstName: true,
  surname: true,
  title: true,
  phone: true,
  country: true,
  placeOfWork: true,
  positionAtWapcp: true,
  matriculationNumber: true,
  topics: true,
  avatarStoredName: true,
} as const;

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: Role;
  disabledAt: Date | null;
  firstName: string | null;
  surname: string | null;
  title: string | null;
  phone: string | null;
  country: string | null;
  placeOfWork: string | null;
  positionAtWapcp: string | null;
  matriculationNumber: string | null;
  topics: string | null;
  avatarStoredName: string | null;
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: Role;
  disabledAt: string | null;
  firstName: string | null;
  surname: string | null;
  title: string | null;
  phone: string | null;
  country: string | null;
  placeOfWork: string | null;
  positionAtWapcp: string | null;
  matriculationNumber: string | null;
  topics: string | null;
  avatarUrl: string | null;
}

export function toUserDto(u: UserRecord): UserDto {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    disabledAt: u.disabledAt ? u.disabledAt.toISOString() : null,
    firstName: u.firstName,
    surname: u.surname,
    title: u.title,
    phone: u.phone,
    country: u.country,
    placeOfWork: u.placeOfWork,
    positionAtWapcp: u.positionAtWapcp,
    matriculationNumber: u.matriculationNumber,
    topics: u.topics,
    avatarUrl: u.avatarStoredName ? `/users/${u.id}/avatar?v=${u.avatarStoredName.slice(0, 12)}` : null,
  };
}
