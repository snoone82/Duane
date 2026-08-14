import { createClient } from "@/lib/supabase/server";
import { UploadFileButton } from "@/components/clients/UploadFileButton";
import { FileRow } from "@/components/clients/FileRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, Thead, Th } from "@/components/ui/Table";

export const metadata = { title: "Files" };

export default async function FilesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: files } = await supabase
    .from("client_files")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-soft">Private to this workspace — nothing here is public.</p>
        <UploadFileButton clientId={id} />
      </div>

      {!files || files.length === 0 ? (
        <EmptyState title="No files yet" description="Upload a headshot, one-pager, contract or brand guide to get started." />
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>File</Th>
              <Th>Category</Th>
              <Th>Size</Th>
              <Th>Uploaded</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {files.map((file) => (
              <FileRow key={file.id} clientId={id} file={file} />
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
