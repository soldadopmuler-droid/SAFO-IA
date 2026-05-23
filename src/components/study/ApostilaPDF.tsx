// Requer: npm install @react-pdf/renderer
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 30, backgroundColor: "#FFFFFF" },
  title: { fontSize: 24, marginBottom: 10, color: "#1a1a1a", fontWeight: "bold" },
  content: { fontSize: 12, lineHeight: 1.5, textAlign: "justify" },
  footer: { position: "absolute", bottom: 30, right: 30, fontSize: 10, color: "grey" },
});

interface ApostilaPDFProps {
  titulo: string;
  conteudo: string;
}

export function ApostilaPDF({ titulo, conteudo }: ApostilaPDFProps) {
  return (
    <Document>
      <Page style={styles.page}>
        <View>
          <Text style={styles.title}>{titulo}</Text>
          <Text style={styles.content}>{conteudo}</Text>
          <Text style={styles.footer}>Gerado por Praça IA - Focado no CFP PM-PR</Text>
        </View>
      </Page>
    </Document>
  );
}
