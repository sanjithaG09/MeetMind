import { MeetingUpload } from "@/components/MeetingUpload";

export default function UploadPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h2>Upload Meeting Recording</h2>
        <p className="text-gray-500 mt-1">
          Upload audio or video files to generate transcripts and AI insights
        </p>
      </div>
      <MeetingUpload />
    </div>
  );
}
