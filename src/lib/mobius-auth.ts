import { auth } from './firebase';

const mergeHeaders = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) return {};
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
};

export const buildMobiusHeaders = async (headers?: HeadersInit): Promise<Record<string, string>> => {
  const merged = mergeHeaders(headers);
  const currentUser = auth.currentUser;

  if (currentUser) {
    const token = await currentUser.getIdToken();
    return {
      ...merged,
      Authorization: `Bearer ${token}`,
    };
  }

  return {
    ...merged,
    'x-mobius-demo-mode': 'true',
  };
};

export const getMobiusRequestStudentId = (): string => auth.currentUser?.uid ?? 'demo-student';
