import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function UploadData() {
  const [, setLocation] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const uploadMutation = trpc.fraud.uploadData.useMutation({
    onSuccess: (data) => {
      toast.success("Analysis completed successfully!");
      setTimeout(() => {
        setLocation("/");
      }, 1500);
    },
    onError: (error) => {
      setError(error.message);
      setUploading(false);
      toast.error("Upload failed: " + error.message);
    },
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError("");

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = (selectedFile: File) => {
    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/zip",
      "application/x-zip-compressed",
    ];

    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv')) {
      setError("Please upload a CSV or ZIP file");
      return;
    }

    setFile(selectedFile);
    setError("");
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setStatus("Reading file...");
    setError("");

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        
        setStatus("Uploading to server...");
        setProgress(10);

        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }, 500);

        await uploadMutation.mutateAsync({
          fileName: file.name,
          fileContent: content,
          fileSize: file.size,
        });

        clearInterval(progressInterval);
        setProgress(100);
        setStatus("Analysis complete!");
      };

      reader.onerror = () => {
        setError("Failed to read file");
        setUploading(false);
      };

      reader.readAsText(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container py-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Upload Data for Analysis
          </h1>
          <p className="text-muted-foreground mt-2">
            Upload Medicaid provider spending data in CSV or ZIP format
          </p>
        </div>
      </div>

      <div className="container py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Data Upload</CardTitle>
            <CardDescription>
              Upload your Medicaid provider spending dataset for fraud detection analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Drag and Drop Area */}
            <div
              className={`
                relative border-2 border-dashed rounded-lg p-12 text-center transition-all
                ${dragActive ? "border-primary bg-primary/5" : "border-border"}
                ${!uploading ? "hover:border-primary/50 cursor-pointer" : "opacity-50 cursor-not-allowed"}
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => !uploading && document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".csv,.zip"
                onChange={handleFileInput}
                className="hidden"
                disabled={uploading}
              />

              {!file ? (
                <div className="space-y-4">
                  <Upload className="h-16 w-16 text-muted-foreground mx-auto" />
                  <div>
                    <p className="text-lg font-medium">
                      Drag and drop your file here
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      or click to browse
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: CSV, ZIP
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <FileText className="h-16 w-16 text-primary mx-auto" />
                  <div>
                    <p className="text-lg font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  {!uploading && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Upload Progress */}
            {uploading && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{status}</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* Success Message */}
            {progress === 100 && !error && (
              <Alert className="border-green-500/50 bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-700 dark:text-green-400">
                  Analysis completed successfully! Redirecting to dashboard...
                </AlertDescription>
              </Alert>
            )}

            {/* Upload Button */}
            <div className="flex gap-3">
              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="flex-1"
                size="lg"
              >
                {uploading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Start Analysis
                  </>
                )}
              </Button>
            </div>

            {/* Data Requirements */}
            <div className="border-t pt-6">
              <h3 className="font-medium mb-3">Data Requirements</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Your CSV file should contain the following columns:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>BILLING_PROVIDER_NPI_NUM</li>
                  <li>SERVICING_PROVIDER_NPI_NUM</li>
                  <li>HCPCS_CODE</li>
                  <li>CLAIM_FROM_MONTH (YYYY-MM-DD format)</li>
                  <li>TOTAL_UNIQUE_BENEFICIARIES</li>
                  <li>TOTAL_CLAIMS</li>
                  <li>TOTAL_PAID</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
