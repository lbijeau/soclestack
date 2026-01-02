'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Download, FileJson } from 'lucide-react';

export function ExportData() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleExport = async () => {
    setIsExporting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/users/export');

      if (!response.ok) {
        const data = await response.json();
        setError(data.error?.message || 'Failed to export data');
        return;
      }

      // Get the blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soclestack-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess('Your data has been exported successfully');
    } catch {
      setError('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="h-5 w-5" />
          Export Your Data
        </CardTitle>
        <CardDescription>
          Download a copy of all your personal data stored in SocleStack
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <div className="space-y-2 text-sm text-gray-600">
          <p>Your export will include:</p>
          <ul className="ml-2 list-inside list-disc space-y-1">
            <li>Profile information (name, email, settings)</li>
            <li>Connected OAuth accounts</li>
            <li>API keys (names and metadata only)</li>
            <li>Active sessions and devices</li>
            <li>Activity logs (last 90 days)</li>
            <li>Notification preferences</li>
          </ul>
          <p className="mt-3 text-gray-500">
            Sensitive data like passwords and 2FA secrets are not included for
            security.
          </p>
        </div>

        <Button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full sm:w-auto"
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Download My Data'}
        </Button>

        <p className="text-xs text-gray-500">
          Limited to 3 exports per day. The export is in JSON format.
        </p>
      </CardContent>
    </Card>
  );
}
