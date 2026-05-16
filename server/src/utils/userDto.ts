import type { Role } from '@prisma/client';

export const userDtoSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  firstName: true,
  surname: true,
  title: true,
  phone: true,
  country: true,
  placeOfWork: true,
  positionAtWapcp: true,
  matriculationNumber: true,
  subject: true,
  avatarStoredName: true,
} as const;

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: Role;
  firstName: string | null;
  surname: string | null;
  title: string | null;
  phone: string | null;
  country: string | null;
  placeOfWork: string | null;
  positionAtWapcp: string | null;
  matriculationNumber: string | null;
  subject: string | null;
  avatarStoredName: string | null;
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: Role;
  firstName: string | null;
  surname: string | null;
  title: string | null;
  phone: string | null;
  country: string | null;
  placeOfWork: string | null;
  positionAtWapcp: string | null;
  matriculationNumber: string | null;
  subject: string | null;
  avatarUrl: string | null;
}

export function toUserDto(u: UserRecord): UserDto {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    firstName: u.firstName,
    surname: u.surname,
    title: u.title,
    phone: u.phone,
    country: u.country,
    placeOfWork: u.placeOfWork,
    positionAtWapcp: u.positionAtWapcp,
    matriculationNumber: u.matriculationNumber,
    subject: u.subject,
    avatarUrl: u.avatarStoredName ? `/users/${u.id}/avatar` : null,
  };
}
