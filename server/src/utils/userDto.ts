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
  registrationNumber: true,
  topics: true,
  avatarStoredName: true,
  profileSubmittedAt: true,
  degreeCertificateStoredName: true,
  degreeCertificateOriginalName: true,
  practiceLicenseStoredName: true,
  practiceLicenseOriginalName: true,
  passportPhotoStoredName: true,
  passportPhotoOriginalName: true,
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
  registrationNumber: string | null;
  topics: string | null;
  avatarStoredName: string | null;
  profileSubmittedAt: Date | null;
  degreeCertificateStoredName: string | null;
  degreeCertificateOriginalName: string | null;
  practiceLicenseStoredName: string | null;
  practiceLicenseOriginalName: string | null;
  passportPhotoStoredName: string | null;
  passportPhotoOriginalName: string | null;
}

export interface StudentDocumentInfo {
  uploaded: boolean;
  originalName: string | null;
  url: string | null;
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
  registrationNumber: string | null;
  topics: string | null;
  avatarUrl: string | null;
  profileSubmittedAt: string | null;
  documents: {
    degreeCertificate: StudentDocumentInfo;
    practiceLicense: StudentDocumentInfo;
    passportPhoto: StudentDocumentInfo;
  };
}

function docInfo(userId: string, kind: string, storedName: string | null, originalName: string | null): StudentDocumentInfo {
  return {
    uploaded: Boolean(storedName),
    originalName: originalName ?? null,
    url: storedName ? `/users/${userId}/documents/${kind}?v=${storedName.slice(0, 12)}` : null,
  };
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
    registrationNumber: u.registrationNumber,
    topics: u.topics,
    avatarUrl: u.avatarStoredName ? `/users/${u.id}/avatar?v=${u.avatarStoredName.slice(0, 12)}` : null,
    profileSubmittedAt: u.profileSubmittedAt ? u.profileSubmittedAt.toISOString() : null,
    documents: {
      degreeCertificate: docInfo(u.id, 'degree-certificate', u.degreeCertificateStoredName, u.degreeCertificateOriginalName),
      practiceLicense: docInfo(u.id, 'practice-license', u.practiceLicenseStoredName, u.practiceLicenseOriginalName),
      passportPhoto: docInfo(u.id, 'passport-photo', u.passportPhotoStoredName, u.passportPhotoOriginalName),
    },
  };
}
