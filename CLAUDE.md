# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Conventions

- 始终用中文交流思考
- 禁止写任何报告，除非明确要求
- 如果编写了测试脚本，测试完毕后必须删除测试文件
- 当处理复杂的前后端交互(尤其是涉及JS事件响应的debug)时，需要通过浏览器来验证修复结果

## Project Overview

UniAI Studio is a Next.js-based AI image editing and generation platform with a frontend-backend separation architecture. The platform integrates Nano Banana API for AI image generation and Sealos object storage for image persistence.

**Key Architecture:**
- **Frontend** (Port 3000): Next.js 14 + React 18 + TypeScript + Zustand state management
- **Backend** (Port 4001): Next.js API Routes + MySQL + AWS S3 SDK (Sealos compatible)
- **Database**: MySQL (uniai_studio database)
- **Storage**: Sealos object storage with separate `input/` and `output/` folders

## Development Commands

### Backend (Port 4001)
```bash
cd backend
npm install                 # Install dependencies
npm run init-db            # Initialize database schema
npm run dev                # Start development server
npm run build              # Build for production
npm start                  # Start production server
npm run lint               # Run ESLint
```

### Frontend (Port 3000)
```bash
cd frontend
npm install                # Install dependencies
npm run dev               # Start development server
npm run build             # Build for production
npm start                 # Start production server
npm run lint              # Run ESLint
```

## Architecture & Design Patterns

### State Management Strategy
The frontend uses **Zustand** (`frontend/lib/store.ts`) as the single source of truth for application state. Key state domains:

1. **Image State**: Supports both single and multiple image selection
   - `currentImage`: Single image display (legacy)
   - `currentImages` + `currentImageIndex`: Multi-image gallery mode
   - `isSelectingImage`: UI mode for image selection
   - `uploadedImages`: Array of reference images (multi-upload support)

2. **Task Queue**: Tasks are managed in Zustand state and synchronized with backend
   - Tasks have status: `pending` | `processing` | `success` | `failed`
   - Support batch generation with `batch_id` and `batch_count`

3. **Favorites**: Dual structure for performance
   - `favorites`: Array for display
   - `favoriteUrls`: Set for O(1) lookup

4. **Inspirations**: Prompt library with drag-and-drop sorting
   - `inspirations`: Array of inspiration items with `{id, title, prompt, tags, image_url, sort_order}`
   - Support CRUD operations and batch sort order updates

### API Communication Pattern
**Backend serves as API proxy layer:**
- Frontend (`frontend/lib/api.ts`) → Backend API Routes (`backend/app/api/*`) → External services (Nano Banana API)
- Backend handles API key management, storage configuration, and database persistence
- All external API calls go through backend to protect credentials

**API Base URL**: `https://ebnqdnzsdhoa.sealosbja.site/api` (configured in `frontend/lib/api.ts`)

### Image Generation Flow
1. **Text-to-Image**: User submits prompt → Backend validates API key → Calls Nano Banana API → Saves result to S3 `output/` folder → Updates task in DB
2. **Image-to-Image**: User uploads reference image(s) → Saves to S3 `input/` folder → Includes `imageUrl` or `imageUrls` in generation request → Nano Banana performs image editing → Result saved to S3 `output/` folder

**Important**: The system supports both single image (`imageUrl`) and multiple images (`imageUrls`) for backward compatibility and batch operations.

### Database Schema (see `backend/scripts/init-db.sql`)
- **images**: Stores metadata for uploaded and generated images
  - Fields: `id`, `filename`, `url`, `storage_path`, `size`, `width`, `height`, `format`
- **tasks**: Generation task queue with status tracking
  - Fields: `id`, `prompt`, `status`, `result_image_id`, `result_images`, `error_message`, `resolution`, `batch_count`
- **favorites**: User-favorited images (URL-based, with foreign key to images)
  - Fields: `id`, `image_id`, `created_at`
  - Unique constraint on `image_id`
- **settings**: Key-value store for API keys and storage configuration
  - Fields: `id`, `setting_key` (unique), `setting_value`
- **inspirations** (if exists): Prompt library items
  - Fields: `id`, `title`, `prompt`, `tags`, `image_url`, `sort_order`

**Critical fields:**
- `tasks.result_images`: JSON text field storing array of generated image URLs (supports batch generation)
- `tasks.batch_id`: Groups related tasks together
- `settings.setting_key`: Includes `nano_banana_api_key`, `storage_enabled`, `storage_external`, `storage_bucket`, `storage_access_key`, `storage_secret_key`

### Storage Architecture
**S3-Compatible Storage** (`backend/lib/storage.ts`):
- Configuration is cached for 60 seconds (1-minute TTL) to reduce database queries
- Two upload paths:
  - `uploadToS3Input()`: User-uploaded reference images → `input/` folder
  - `uploadToS3Output()`: AI-generated images → `output/` folder
- Storage config can be disabled; when disabled, APIs return `null` gracefully
- Use `clearStorageConfigCache()` after updating settings

### Database Connection Pool
**Singleton pattern** (`backend/lib/db.ts`):
- Pool is created once and reused
- Connection limit: 10
- Use `query<T>(sql, params)` helper for type-safe queries
- **Important**: Always use parameterized queries to prevent SQL injection

## Common Development Patterns

### Adding New API Endpoints
1. Create route file: `backend/app/api/[endpoint]/route.ts`
2. Export `GET`, `POST`, `PUT`, `DELETE` as needed
3. Use `NextRequest` and `NextResponse` from `next/server`
4. Query database with `query()` from `@/lib/db`
5. Return JSON with proper status codes

**Example Pattern:**
```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();
  const results = await query('SELECT * FROM table WHERE id = ?', [body.id]);
  return NextResponse.json({ data: results });
}
```

### Adding Frontend Components
- Place in `frontend/components/`
- Import Zustand store: `import { useAppStore } from '@/lib/store'`
- Use Lucide React for icons: `import { Icon } from 'lucide-react'`
- Style with Tailwind CSS classes
- For modals, use Headless UI (`@headlessui/react`)

### API Endpoints Reference
The backend exposes the following API routes (all under `/api`):

**Core Generation & Upload:**
- `POST /api/upload` - Upload reference images (multipart/form-data)
- `POST /api/generate` - Create AI generation task
- `GET /api/tasks` - List all tasks (supports `?limit=N` param)
- `GET /api/tasks/[taskId]` - Get specific task status

**Favorites Management:**
- `GET /api/favorites` - List all favorited images
- `POST /api/favorites` - Add image to favorites (body: `{url, prompt?, filename?}`)
- `DELETE /api/favorites/[url]` - Remove from favorites (URL must be encoded)
- `GET /api/favorites/[url]` - Check if image is favorited

**Inspirations (Gallery/Prompt Library):**
- `GET /api/inspirations` - List all inspiration items
- `POST /api/inspirations` - Create inspiration (body: `{title, prompt, tags?, image_url?}`)
- `PUT /api/inspirations/[id]` - Update inspiration
- `DELETE /api/inspirations?id=[id]` - Delete inspiration
- `POST /api/inspirations/import` - Import inspirations from storage bucket
- `PUT /api/inspirations` - Update sort order (body: `{id, sort_order}`)
- `POST /api/inspirations/batch-update` - Batch update sort orders

**Image Processing:**
- `POST /api/cutout` - Background removal/image cutout (body: `{imageUrl}`)

**Configuration:**
- `GET /api/settings?key=[key]` - Get setting value
- `POST /api/settings` - Save setting (body: `{key, value}`)

### Model Selection
**Available Nano Banana Models** (defined in `backend/app/api/generate/route.ts`):
- `nano-banana-2` (default)
- `nano-banana-2-2k`
- `nano-banana-2-4k`
- `nano-banana-hd`
- `nano-banana-pro`
- `nano-banana` (v1)

**Resolution & Aspect Ratio:**
- Resolutions: `1K`, `2K`, `4K` (passed as `image_size` to API)
- Aspect ratios: `Auto`, `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`

### Error Handling Conventions
- **Frontend**: Graceful degradation with fallbacks (see `uploadImage()` in `api.ts`)
- **Backend**: Try-catch with console logging and proper HTTP status codes
- **Database**: Return empty arrays `[]` instead of throwing on query failures
- **Storage**: Return `null` when storage is not configured (not an error state)

## Testing & Debugging

### Running the Full Stack
1. Start MySQL database (must be accessible at configured host)
2. Run `npm run init-db` in backend (first time only)
3. Start backend: `cd backend && npm run dev` (port 4001)
4. Start frontend: `cd frontend && npm run dev` (port 3000)
5. Configure API key on first visit via modal

### Common Issues
- **Port conflicts**: Ensure ports 3000 and 4001 are free
- **Database connection**: Check MySQL is running and credentials in `backend/lib/db.ts` are correct
- **CORS errors**: Backend uses CORS middleware; check `API_BASE_URL` in `frontend/lib/api.ts`
- **API key errors**: API key is stored in `settings` table, retrieve via settings API

## Important Implementation Notes

1. **Multi-image support**: When implementing features that handle images, always consider both single-image (`uploadedImage`) and multi-image (`uploadedImages`) modes for backward compatibility.

2. **Async task processing**: Image generation uses `processGenerationTask()` which runs asynchronously after responding to the client. Task status is polled by frontend.

3. **Storage flexibility**: Always check if storage is enabled before attempting S3 operations. The system should work without S3 configured (using data URLs or temporary storage).

4. **Batch operations**: Tasks can be grouped with `batch_id`. A single user action may create multiple tasks (controlled by `batchCount`).

5. **TypeScript types**: Frontend and backend share similar types but are defined separately. Keep `Task`, `Favorite`, `Inspiration` interfaces in sync between `frontend/lib/store.ts` and backend route handlers.

6. **Configuration caching**: Storage configuration uses a 60-second cache. When updating storage settings via API, call `clearStorageConfigCache()` to invalidate the cache.

7. **Inspirations feature**: The system includes a prompt library ("灵感广场") where users can save and reuse prompts. Support drag-and-drop reordering via `sort_order` field and batch updates.

8. **Image cutout API**: The `/api/cutout` endpoint provides background removal functionality. It accepts an `imageUrl` and returns the processed image (implementation may use MediaPipe or external services).
