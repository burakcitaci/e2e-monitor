using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace ServiceBusExample;

public sealed record CaptureEvent(
    int SchemaVersion,
    string EventId,
    string CaptureId,
    string MessageId,
    string Namespace,
    string Destination,
    string Type,
    string Service,
    DateTimeOffset OccurredAt,
    string? Subscription = null,
    string? Body = null);

// Best-effort reporting. Never turn telemetry failure into message redelivery.
public sealed class CaptureSink(HttpClient http, string token)
{
    public async Task ReportAsync(CaptureEvent capture)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "events");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            request.Content = JsonContent.Create(capture, options: new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web)
            {
                DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
            });
            using var response = await http.SendAsync(request, timeout.Token);
            response.EnsureSuccessStatusCode();
            Console.WriteLine($"[capture] {capture.Type} reported captureId={capture.CaptureId}");
        }
        catch (Exception error) when (error is HttpRequestException or OperationCanceledException)
        {
            Console.Error.WriteLine($"[capture warning] {capture.Type} was not persisted: {error.Message}");
        }
    }
}
