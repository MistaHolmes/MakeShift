import { Router } from 'express';
import multer from 'multer';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { prisma } from '../config/prisma';
import { s3 } from '../config/s3';
import { extractPagesFromPdf } from '../services/pdfService';
import { generateTTSWithTimestamps } from '../services/elevenLabsService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', upload.single('pdf'), async (req: any, res: any) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });

    console.log(`[INFO] Received PDF upload: ${req.file.originalname}`);
    const filename = req.file.originalname || 'document.pdf';
    const pagesText = await extractPagesFromPdf(req.file.buffer);

    const doc = await prisma.document.create({
      data: {
        title: filename.replace('.pdf', ''),
        filename: filename,
        status: 'UPLOADED',
      }
    });

    const pagesData = pagesText.map((text, index) => ({
      documentId: doc.id,
      pageNumber: index + 1,
      textContent: text,
      status: 'PENDING' as const,
    }));

    await prisma.page.createMany({ data: pagesData });

    res.json({ message: 'Document uploaded and parsed', documentId: doc.id, totalPages: pagesText.length });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process document' });
  }
});

router.post('/:id/generate', async (req: any, res: any) => {
  try {
    const documentId = req.params.id;
    
    await prisma.document.update({ where: { id: documentId }, data: { status: 'GENERATING_AUDIO' } });
    
    const pages = await prisma.page.findMany({ 
      where: { documentId, status: 'PENDING' },
      orderBy: { pageNumber: 'asc' } 
    });

    if (pages.length === 0) {
      console.warn(`[WARN] No pending pages found for document ${documentId}`);
      return res.json({ message: 'No pending pages found for generation' });
    }

    console.log(`[INFO] Starting ElevenLabs audio generation for Document ${documentId}`);
    console.log(`[INFO] Found ${pages.length} pages to process.`);

    // Process pages sequentially
    for (const page of pages) {
      if (!page.textContent.trim()) {
         console.log(`[INFO] Skipping empty page ${page.pageNumber}`);
         await prisma.page.update({ where: { id: page.id }, data: { status: 'GENERATED' } });
         continue;
      }
      
      try {
        console.log(`[INFO] Generating audio for page ${page.pageNumber}...`);
        const { audioBuffer, alignment } = await generateTTSWithTimestamps(page.textContent);
        
        console.log(`[INFO] Uploading audio for page ${page.pageNumber} to Cloudflare R2...`);
        const audioFilename = `audio/${documentId}/page-${page.pageNumber}-${randomUUID()}.mp3`;
        
        await s3.send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: audioFilename,
          Body: audioBuffer,
          ContentType: 'audio/mpeg'
        }));
        
        const audioUrl = `${process.env.R2_PUBLIC_URL}/${audioFilename}`;
        
        await prisma.page.update({
          where: { id: page.id },
          data: {
            audioUrl,
            alignmentData: alignment as any,
            status: 'GENERATED'
          }
        });
      } catch (err) {
        console.error(`Failed to generate TTS for page ${page.pageNumber}:`, err);
        await prisma.page.update({ where: { id: page.id }, data: { status: 'ERROR' } });
      }
    }

    await prisma.document.update({ where: { id: documentId }, data: { status: 'READY' } });
    console.log(`[INFO] Finished processing document ${documentId}`);
    res.json({ message: 'Audio generation complete' });

  } catch (error: any) {
    console.error('Generate error:', error);
    res.status(500).json({ error: 'Failed to generate audio' });
  }
});

router.get('/:id/pages', async (req: any, res: any) => {
  try {
    const pages = await prisma.page.findMany({
      where: { documentId: req.params.id },
      orderBy: { pageNumber: 'asc' }
    });
    res.json(pages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pages' });
  }
});

router.get('/', async (req: any, res: any) => {
  try {
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

export default router;
