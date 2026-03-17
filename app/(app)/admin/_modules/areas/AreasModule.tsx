"use client";

import DepartmentsModule from "../departments/DepartmentsModule";

export default function AreasModule({ hotelId }: { hotelId: string }) {
  return <DepartmentsModule hotelId={hotelId} />;
}
