import type { Request, Response } from 'express';

type StudentSource = 'params' | 'body' | 'query';

interface ResolveStudentScopeOptions {
  source: StudentSource;
  field?: string;
  required?: boolean;
  fallbackToCurrentUser?: boolean;
}

const readStudentField = (req: Request, source: StudentSource, field: string): unknown => {
  if (source === 'params') return req.params[field];
  if (source === 'query') return req.query[field];
  return req.body?.[field];
};

export const getCurrentUserId = (req: Request): string | null => req.authContext?.currentUserId ?? null;

export const resolveStudentScope = (
  req: Request,
  res: Response,
  options: ResolveStudentScopeOptions,
): string | null => {
  const currentUserId = getCurrentUserId(req);
  if (!currentUserId) {
    res.status(401).json({ error: 'Authentication is required.' });
    return null;
  }

  const field = options.field ?? 'studentId';
  const rawValue = readStudentField(req, options.source, field);
  const studentId = typeof rawValue === 'string' ? rawValue.trim() : '';

  if (!studentId) {
    if (options.fallbackToCurrentUser) {
      return currentUserId;
    }
    if (options.required === false) {
      return null;
    }
    res.status(400).json({ error: `${field} is required.` });
    return null;
  }

  if (studentId !== currentUserId) {
    res.status(403).json({ error: 'studentId does not match the authenticated user.' });
    return null;
  }

  return studentId;
};

export const assertStudentOwnership = (req: Request, res: Response, ownerStudentId: string): boolean => {
  const currentUserId = getCurrentUserId(req);
  if (!currentUserId) {
    res.status(401).json({ error: 'Authentication is required.' });
    return false;
  }

  if (ownerStudentId !== currentUserId) {
    res.status(403).json({ error: 'You do not have access to this student resource.' });
    return false;
  }

  return true;
};
