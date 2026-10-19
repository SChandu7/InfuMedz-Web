/* InfuMedz website - API client.
 *
 * Mirrors lib/core/api/api_endpoints.dart one-for-one, including the paths
 * that do NOT carry the /api/infumedz/ prefix (the presigned-upload ones).
 * That inconsistency lives on the backend; it is reproduced faithfully here
 * rather than "tidied", because tidying it would simply 404.
 *
 * Auth model, as the backend actually works today:
 *   - login returns {user_id, name, email} and NO token
 *   - customer endpoints take the user_id in the URL path
 *   - admin endpoints are protected by an X-Admin-Token header obtained
 *     from admin/login/ (see session.js)
 *
 * Because GitHub Pages serves this file publicly, it holds no secrets of
 * any kind. Every credential is supplied at runtime by the person using
 * the site.
 */

export const BASE = 'https://api.chandus7.in';

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

async function request(path, options = {}) {
  const method = options.method || 'GET';
  const body = options.body;
  const headers = options.headers || {};
  const timeout = options.timeout || 30000;

  const url = path.startsWith('http') ? path : BASE + path;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);

  const opts = { method, headers: Object.assign({}, headers), signal: ctrl.signal };

  if (body !== undefined) {
    if (body instanceof FormData) {
      opts.body = body;                      // let the browser set the boundary
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      throw new ApiError('Request timed out. Check your connection.', 0, null);
    }
    throw new ApiError('Could not reach the server. Check your connection.', 0, null);
  }
  clearTimeout(timer);

  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (_) { data = text; }
  }

  if (!res.ok) {
    // The backend is consistent about {"error": "..."} and those strings are
    // already written for end users, so surface them verbatim.
    const msg = (data && typeof data === 'object' && data.error)
      ? data.error
      : 'Request failed (' + res.status + ')';
    throw new ApiError(msg, res.status, data);
  }
  return data;
}

const get  = (p, h)    => request(p, { headers: h });
const post = (p, b, h) => request(p, { method: 'POST', body: b, headers: h });
const del  = (p, h)    => request(p, { method: 'DELETE', headers: h });

export const api = {
  /* Auth */
  signup:  (d) => post('/api/infumedz/signup/', d),
  login:   (identifier, password) => post('/api/infumedz/login/', { identifier, password }),
  google:  (idToken) => post('/api/infumedz/googleauth/', { id_token: idToken }),
  profile: (uid) => get('/api/infumedz/user/' + uid + '/'),
  deleteAccount: (uid) => del('/api/infumedz/user/delete/' + uid + '/'),

  /* Catalogue */
  categories: () => get('/api/infumedz/categories/'),
  courses:    () => get('/api/infumedz/courses/'),
  course:     (id) => get('/api/infumedz/courses/' + id + '/'),
  books:      () => get('/api/infumedz/books/'),
  book:       (id) => get('/api/infumedz/books/' + id + '/'),
  banner:     () => get('/api/infumedz/app-banner/'),
  config:     () => get('/api/infumedz/app-config/'),

  /* Access + library */
  library:     (uid) => get('/api/infumedz/library/' + uid + '/'),
  checkAccess: (uid, type, id) =>
    get('/api/infumedz/check-access/' + uid + '/' + type + '/' + id + '/'),

  /* Payments */
  createCourseOrder: (user, courseId) =>
    post('/api/infumedz/payment/create-course-order/', { user, course_id: courseId }),
  createBookOrder: (user, bookId) =>
    post('/api/infumedz/payment/create-book-order/', { user, book_id: bookId }),
  verifyPayment: (d) => post('/api/infumedz/payment/verify-payment/', d),

  /* Reviews */
  courseReviews:   (id) => get('/api/infumedz/course/' + id + '/reviews/'),
  bookReviews:     (id) => get('/api/infumedz/book/' + id + '/reviews/'),
  addCourseReview: (d) => post('/api/infumedz/course/review/add/', d),
  addBookReview:   (d) => post('/api/infumedz/book/review/add/', d),

  /* Notifications */
  notifications:      (uid) => get('/api/infumedz/notifications/' + uid + '/'),
  markNotification:   (d) => post('/api/infumedz/notifications/read/', d),
  clearNotifications: (uid) => post('/api/infumedz/notifications/clear/' + uid + '/', {}),

  /* Support */
  faqs:         () => get('/api/infumedz/faq/list/'),
  chatHistory:  (uid) => get('/api/infumedz/chat/history/' + uid + '/'),
  sendChat:     (d) => post('/api/infumedz/chat/message/', d),
  createTicket: (d) => post('/api/infumedz/chat/ticket/create/', d),

  /* Admin - every call needs the X-Admin-Token header */
  admin: {
    login: (email, password) => post('/api/infumedz/admin/login/', { email, password }),

    dashboard: (h) => get('/api/infumedz/dashboard/', h),
    users:     (h) => get('/api/infumedz/admin/users/', h),
    reviews:   (h) => get('/api/infumedz/admin/reviews/', h),
    tickets:   (h) => get('/api/infumedz/tickets/', h),

    createCourse: (d, h) => post('/api/infumedz/course/create/', d, h),
    createBook:   (d, h) => post('/api/infumedz/book/create/', d, h),
    deleteCourse: (id, h) => del('/api/infumedz/course/' + id + '/', h),
    deleteBook:   (id, h) => del('/api/infumedz/book/' + id + '/', h),

    addCourseVideo:    (d, h) => post('/api/infumedz/course/video/add/', d, h),
    addBookPdf:        (d, h) => post('/api/infumedz/book/pdf/add/', d, h),
    deleteCourseVideo: (id, h) => del('/api/infumedz/course/video/' + id + '/delete/', h),
    deleteBookPdf:     (id, h) => del('/api/infumedz/book/pdf/' + id + '/delete/', h),

    courseChapters:   (cid, h) => get('/api/infumedz/course/' + cid + '/chapters/', h),
    addCourseChapter: (d, h) => post('/api/infumedz/course/chapter/add/', d, h),
    bookChapters:     (bid, h) => get('/api/infumedz/book/' + bid + '/chapters/', h),
    addBookChapter:   (d, h) => post('/api/infumedz/book/chapter/add/', d, h),

    replyCourseReview: (d, h) => post('/api/infumedz/admin/course-review/reply/', d, h),
    replyBookReview:   (d, h) => post('/api/infumedz/admin/book-review/reply/', d, h),
    replyTicket:       (d, h) => post('/api/infumedz/ticket/reply/', d, h),

    notifyAudience: (h) => get('/api/infumedz/admin/notify/audience/', h),
    notifySend:     (d, h) => post('/api/infumedz/admin/notify/send/', d, h),
    notifyAnnounce: (d, h) => post('/api/infumedz/admin/notify/announce/', d, h),
    assignContent:  (d, h) => post('/api/infumedz/admin/assign-content/', d, h),

    addFaq:    (d, h) => post('/api/infumedz/faq/add/', d, h),
    deleteFaq: (id, h) => del('/api/infumedz/faq/delete/' + id + '/', h),

    banner: (d, h) => post('/api/infumedz/app-banner/', d, h),

    /* These two paths genuinely carry no /api/infumedz/ prefix. */
    uploadThumbnail: (formData, h) => post('/api/infumedz/upload/course-thumbnail/', formData, h),
    presignVideo:    (d, h) => post('/upload/video/presigned/', d, h),
    presignPdf:      (d, h) => post('/upload/book/presigned/', d, h),

    /* Raw PUT straight to the signed URL the two calls above return.
       Deliberately not routed through request(): the body is the file itself
       and must not be JSON-encoded, and we want upload progress. */
    putFile(uploadUrl, file, onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        if (onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress(e.loaded / e.total);
          };
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(true);
          else reject(new ApiError('Upload failed (' + xhr.status + ')', xhr.status, null));
        };
        xhr.onerror = () => reject(new ApiError('Upload failed - connection lost', 0, null));
        xhr.send(file);
      });
    },
  },
};
