<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import z from "zod";
  import { page } from "$app/state";

  const slug = z.string().parse(page.params.slug);

  goto(resolve(`/${slug}/agents`));
</script>
