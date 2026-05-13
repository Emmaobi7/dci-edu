import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  createClassroom,
  deleteClassroom,
  getClassroom,
  listClassrooms,
  regenerateCode,
  updateClassroom,
} from '../controllers/classroom.controller.js';
import { listStudents, removeStudent } from '../controllers/enrolment.controller.js';
import { createAssignment, listAssignments } from '../controllers/assignment.controller.js';
import { createAnnouncement, listAnnouncements } from '../controllers/announcement.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(listClassrooms));
router.post('/', asyncHandler(createClassroom));
router.get('/:id', asyncHandler(getClassroom));
router.patch('/:id', asyncHandler(updateClassroom));
router.delete('/:id', asyncHandler(deleteClassroom));
router.post('/:id/regenerate-code', asyncHandler(regenerateCode));
router.get('/:id/students', asyncHandler(listStudents));
router.delete('/:id/students/:studentId', asyncHandler(removeStudent));
router.get('/:id/assignments', asyncHandler(listAssignments));
router.post('/:id/assignments', asyncHandler(createAssignment));
router.get('/:id/announcements', asyncHandler(listAnnouncements));
router.post('/:id/announcements', asyncHandler(createAnnouncement));

export default router;
